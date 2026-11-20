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

## Phase 4 (PR 4): S4 RF-07, cards that tell requests apart

Mode: Strict TDD. Date: 2026-11-20. Branch "feat/flow-experience-4-card-reasons", cut from the tip of "feat/flow-experience-3b-report-answer-errors" (67cf703, all of S3). Size exception per the owner decision of 2026-11-20 (see Phase 1); if the slice goes over the stop line it is cut after unit 7 into "-4-card-reasons" (data and excerpt helper) and "-4b-..." (the card), as the plan says.

### Owner decision of 2026-11-20 on task 4.1

- **(a) No excerpt on "aprobada" cards.** The decision excerpt shows ONLY on "devuelta" and "rechazada" cards, never on "aprobada" cards. Reason: approval text is template boilerplate and approved students do not ask why, so the excerpt would add noise; the student already sees the full text in the detail. This reverses the spec default (FE-15 listed "aprobada"). Edited to match: spec FE-15 in `openspec/changes/flow-experience/specs/student-requests/spec.md` (requirement text, header note, the table-driven scenario split in two, and a new scenario "Approved card shows no excerpt"), design D7 in `openspec/changes/flow-experience/design.md`, and the tasks 4.1, 4.4 and 4.8 text and the convention line about known spec differences in `openspec/changes/flow-experience/tasks.md`.
- **(b) Excerpt rule.** At most 140 characters with an ellipsis when cut, shown in up to 2 lines (owner resolution 3, 2026-11-20).

### PR #98 merged (2026-11-20): unblocks S8

"gh pr view 98": MERGED at 2026-11-20T17:57:26Z as 27abd8c on "main" ("Merge pull request #98 from Josuedcm03/docs/thesis-sync-p3-2"). After "git fetch origin main", "drizzle/" on "origin/main" still ends at 0015, so 0016 is still free. This satisfies the precondition of task 8.0 (the entry itself is recorded when S8 starts). Main was NOT merged into the tracker or into any slice now; it is merged into the tracker only when the plan says (before S8).

### Cut decision

Unit 7 (the data layer and the excerpt helper) measured 606 changed lines, over the 460 stop line on its own, so the slice is cut after unit 7 as the plan says (candidate cut: PR 4 after unit 7):

- **PR 4**, branch "feat/flow-experience-4-card-reasons", cut from the tip of "feat/flow-experience-3b-report-answer-errors": unit 7 (tasks 4.2 to 4.7). It stacks on #113.
- **PR 4b**, branch "feat/flow-experience-4b-request-card", cut from the tip of PR 4: unit 8 (tasks 4.8 to 4.10), the card and its copy.

Unit 7 is not cut further: its only seam (the excerpt helper, 101 lines, against the reader and its tests, 505 lines) would leave a PR whose helper nothing calls. Tests are 81 percent of the lines and were not trimmed. Size exception per the owner decision of 2026-11-20 (see Phase 1).

### Commits (PR 4)

| Unit | Hash    | Message                                                                              |
| ---- | ------- | ------------------------------------------------------------------------------------ |
| 4.1  | 7d86f90 | docs(flow-experience): record the owner decision that approved cards show no excerpt |
| 7    | a2fe9f2 | feat(requests): read subjects and the decision reason for each own request           |
| docs | (tip)   | docs(flow-experience): record the Phase 4 apply progress for PR 4                    |

### TDD cycle evidence (PR 4)

| Task        | Test file                                         | Layer | Safety net                                                          | RED                                                                                                                       | GREEN                         | Triangulation                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Refactor      |
| ----------- | ------------------------------------------------- | ----- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 4.2 and 4.3 | `src/lib/data/decision-excerpt.test.ts` (new)     | Unit  | N/A (new file)                                                      | The file failed to load (module missing)                                                                                  | 1 file, 14 passed             | 200 chars cut to 140 plus an ellipsis; exactly 140 whole; 141 cut; 60 whole; null, undefined, empty and two whitespace-only texts give null; surrounding whitespace trimmed; trailing whitespace trimmed before the ellipsis; a surrogate pair at the cut kept whole; 140 emoji count as 140                                                                                                                                                                                  | Prettier only |
| 4.4 and 4.5 | `src/lib/data/student-requests.test.ts`           | Unit  | 4 listOwnRequests cases and the detail and correction cases passing | 20 cases failed first (shape, select count, class and decision reads, excerpt, reason code, approved rule, skip rule)     | 66 passed with the next row   | Rows with subjects and decision; owner and visible-state filter; order; empty list issues 1 select; 1, 2 and 5 rows issue 3; ids passed to both reads; subjects in the order of `listRequestClasses`; no class rows; latest of two decisions; returned code and text; rejected excerpt (200, 60, null, blank); long text never leaves; code only for returned; approved gets none (2 texts); approved never read; open states get none (2); skip rule; read-only             | None needed   |
| 4.4 and 4.5 | `src/app/(dashboard)/requests/no-signals.test.ts` | Unit  | Existing cases passing                                              | 2 cases failed first (the list keys gain "asignaturas" and "decision"; a list row with a long decision reveals no signal) | Pass                          | Exact list keys, selects only, 3 statements; the card decision carries only "motivoCodigo" and "texto"; the subject carries only "codigo" and "nombre"; the REVEALING scan of the serialized rows                                                                                                                                                                                                                                                                             | None needed   |

### Mutation checks (revert-only; the file was restored from a byte-identical backup copy and checked with "cmp", because the GREEN was not committed yet)

| Test                                                                          | Temporary edit in `src/lib/data/student-requests.ts`   | Result                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| select-count cases (task 4.6)                                                 | Read the classes once per row inside the mapping       | 10 failed, including the 2- and 5-row select-count cases             |
| approved-gets-none (2), approved-never-read, skip rule                        | Add "aprobada" to the states whose decision is read    | 4 failed, as expected                                                |
| "keeps the reason code only for a returned request, never for a rejected one" | Pass the reason code through for every state           | 1 failed, as expected                                                |
| "reads only: no write and no audit row" and the statement-count cases         | Add an insert before the class read                    | 22 failed, including it (the double refuses an unscripted statement) |

### Checkpoint (task 4.11): measured size of PR 4

Measure: "git diff --numstat feat/flow-experience-3b-report-answer-errors...HEAD" excluding "openspec/" and ".engram/".

| Scope                                         | Changed lines |
| --------------------------------------------- | ------------- |
| Production (excerpt helper 28, reader 88)     | 116           |
| Tests (excerpt 73, reader 365, no-signals 52) | 490           |
| All of PR 4 (596 added, 10 deleted)           | 606           |

The design forecast for all of S4 was about 250; unit 7 alone is 2.4 times that. Tests are 81 percent of the lines.

### Work unit evidence (PR 4)

| Evidence                              | Value                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- src/lib/data/student-requests src/lib/data/decision-excerpt src/app/(dashboard)/requests": 23 files, 533 tests, all passed                                                                                                    |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-07_c" on "flow-it" (task 12.8) is not part of PR 4, and no database or Neon command was run (the dummy DB URL and the statement double only)                                                                                                |
| Rollback boundary                     | Revert the PR: `src/lib/data/decision-excerpt.ts` is removed and `src/lib/data/student-requests.ts` returns its old list shape (one select, no subjects, no decision). Nothing renders the new fields until PR 4b, so the screens do not change. No data, no schema, no audit event type |

### Gates (task 4.12), tip of "-4-card-reasons", dummy DB

- Full "npm test": 370 files, 9097 tests, all passed, 272.6 s vitest duration. PR 3b was 369 files and 9061 tests; PR 4 adds one test file (decision-excerpt) and 36 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (143810 lines), the only findings are the same three in files PR 4 does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the five touched files alone is clean, and "npx prettier --check" passes on all of them.
- i18n is not touched by PR 4.

### Files (PR 4; all LF in the working tree, the index was already LF)

| File                                                                                       | Action                                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `src/lib/data/decision-excerpt.ts`                                                         | Created: DECISION_EXCERPT_MAX and the pure decisionExcerpt                                       |
| `src/lib/data/decision-excerpt.test.ts`                                                    | Created: 14 cases                                                                                |
| `src/lib/data/student-requests.ts`                                                         | Modified: OwnCardDecision, OwnRequestListItem, listOwnRequests with the class and decision reads |
| `src/lib/data/student-requests.test.ts`, `src/app/(dashboard)/requests/no-signals.test.ts` | Modified: the list block rewritten and extended; LIST_KEYS gains "asignaturas" and "decision"    |

No Spanish UI copy is added in PR 4 (the card copy is PR 4b).

### Deviations (PR 4)

1. **Branch names.** Task 4.0 says "feat/flow-experience-4-request-cards"; the owner's run order says "feat/flow-experience-4-card-reasons", which is used. The cut branch is "feat/flow-experience-4b-request-card". Tasks 4.11 and 4.13 name "feat/flow-experience-3-note-errors" as the base; the real base is the tip of "feat/flow-experience-3b-report-answer-errors" (#113).
2. **Approved cards (owner decision of 2026-11-20).** The design, the spec and tasks 4.1, 4.4 and 4.8 changed so an approved request carries no decision at all; the data layer does not even read it. The spec was edited first.
3. **Reason code kept only for a returned request.** The design types the decision as a code and a text; the reader sets the code to null for a rejected request (D7 says a rejection carries no code), so the card cannot show a code the design does not allow.
4. **Excerpt applied to every kept text.** Including the text of a returned request, so no complete decision text reaches the client list.
5. **Mutation checks with an uncommitted GREEN.** As in S1 to S3: byte-identical backup copy restored and checked with "cmp".
6. **Cut at unit 7, size exception.** See the cut decision.
7. **Tasks 4.11 to 4.13.** They close when PR 4b is done, over both PRs.

### PR 4b: the card (unit 8)

Branch "feat/flow-experience-4b-request-card", cut from the tip of PR 4 ("feat/flow-experience-4-card-reasons", 7f8c018). It targets that branch. Together with PR 4 it closes S4. Pull requests: PR 4 is #114 ("https://github.com/Josuedcm03/justifia/pull/114", base "feat/flow-experience-3b-report-answer-errors", stacked on #113) and PR 4b is #115 ("https://github.com/Josuedcm03/justifia/pull/115", base "feat/flow-experience-4-card-reasons").

#### Commits (PR 4b)

| Unit | Hash    | Message                                                                  |
| ---- | ------- | ------------------------------------------------------------------------ |
| 8    | 6f8fd63 | feat(requests): label the dates and show subjects and reasons on the cards |
| docs | (tip)   | docs(flow-experience): record the Phase 4 apply progress for PR 4b       |

#### TDD cycle evidence (PR 4b)

| Task        | Test file                                                  | Layer     | Safety net                                   | RED                                                                                                                                                                                     | GREEN                                       | Triangulation                                                                                                                                                                                                                                                                                                                                                                                                                    | Refactor    |
| ----------- | ---------------------------------------------------------- | --------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 4.8 and 4.9 | `src/app/(dashboard)/requests/request-card.test.tsx` (new) | Component | N/A (new file); existing requests cases passing    | 16 cases failed first (the labelled absence line en, es, one day; subjects 1, 3, 5 and 4 codes and es; the five reasons; the clamp; es reason; 360 px); the negative cases pass at write | requests directory and i18n: 31 files, 936 passed | Range, one day, Spanish, missing dates; 1, 3, 5, 4 subjects and Spanish and none; returned with code, with the date code, without a known code; rejected short and cut; no line for a returned request with nothing, a rejected one without a decision, a pending one with a stray decision, one in coordination; approved with text, with a long text, without a decision; props with signals, an outcome, a verdict and an escalation note; link; 360 px | None needed |
| 4.8 and 4.9 | `src/app/(dashboard)/requests/page.test.tsx`               | Component | Existing cases passing                       | 2 cases failed first (items passed through to their own cards; the label on every card); the approved stray-decision case passes at write                                               | Pass                                        | Returned, rejected and approved items in one list; labelled dates; approved card with a carried decision                                                                                                                                                                                                                                                                                                                          | None needed |
| 4.8 and 4.9 | `src/app/(dashboard)/requests/design-system.test.tsx`      | Component | Existing suites green                        | 2 cases failed first (muted ink for the labelled lines and body ink with the clamp for the reason; five long codes inside 360 px)                                                      | Pass                                        | Class-level pins: muted ink, line-clamp-2, break-words, no fixed width above the viewport                                                                                                                                                                                                                                                                                                                                         | None needed |
| 4.8 and 4.9 | `src/i18n/requests-messages.test.ts`                       | Unit      | Existing cases passing                       | 3 cases failed first (exact copy es and en; the reason label equals the detail's label)                                                                                                  | Pass                                        | Exact copy of the four keys in es and en; no form of address in either; same "Motivo" and "Reason" label as the detail                                                                                                                                                                                                                                                                                                            | None needed |
| 4.8         | `src/app/(dashboard)/requests/no-signals.test.ts`          | Component | Existing cases passing                       | Pass at write (its list rows now carry subjects and a decision, and the page shows them); mutation check below                                                                         | Pass                                        | Four states in both locales with no signal word                                                                                                                                                                                                                                                                                                                                                                                   | None needed |

#### Mutation checks (revert-only; files restored from byte-identical backup copies and checked with "cmp", because the GREEN was not committed yet)

| Pass-at-write test                                                                                        | Temporary edit                                                                              | Result                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| no reason line (returned with nothing, pending, coordination) and the three approved cases, page approved | In `src/app/(dashboard)/requests/request-card.tsx`: drop the state gate of the reason       | 5 failed, including the pending, coordination and approved cases                       |
| the reason cases and no-signals list                                                                      | A signal word and a verdict word added to the reason line                                   | The reason cases failed, and so did the no-signals list case "renders every visible state without a signal, outcome, verdict or fingerprint" |
| the state labels, the neutral label                                                                       | The state pill always receives "pendiente"                                                  | Failed, including the coordination and every state-label case                         |
| "shows no absence line when the dates are missing", "shows no subject line for a request without subjects" | The dates line and the subjects line always render                                         | 2 failed, as expected                                                                 |
| "links to the detail of its own request" and the page link case                                           | The link target is the next id                                                              | 2 failed, as expected                                                                 |
| "renders no signal, outcome, verdict, motive, note or answer even when the props carry them"              | The serialized props are rendered inside the card                                           | 6 failed, including it                                                                |
| "keeps the card labels free of any form of address" and the exact-copy case                                | In `i18n/es.json`: "Revisa tus fechas de ausencia: {period}" instead of the absence label  | 2 failed, as expected                                                                 |

#### Checkpoint (task 4.11): measured size of PR 4b

Measure: "git diff --numstat feat/flow-experience-4-card-reasons...HEAD" excluding "openspec/" and ".engram/".

| Scope                                                                                                       | Changed lines |
| ----------------------------------------------------------------------------------------------------------- | ------------- |
| Production (card 56, two catalogs 8)                                                                        | 64            |
| Tests (card 307, page 56, design system 42, copy 46, no-signals 5)                                          | 456           |
| All of PR 4b (514 added, 6 deleted)                                                                         | 520           |
| PR 4 (unit 7)                                                                                               | 606           |
| All of S4                                                                                                   | 1126          |

The design forecast for S4 was about 250; S4 is 4.5 times that. Tests are 88 percent of PR 4b. Both parts are over the 460 stop line; PR 4 is the plan's cut after unit 7, and unit 8 has no seam (the card, the page pin and the copy are one behaviour). Size exception per the owner decision of 2026-11-20. Tests were not trimmed.

#### Work unit evidence (PR 4b)

| Evidence                              | Value                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- src/app/(dashboard)/requests src/i18n": 31 files, 936 tests, all passed                                                                                                                                                            |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-07_c" on "flow-it" (task 12.8) is not part of Phase 4, and no database or Neon command was run                                                                                                                                                  |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/requests/request-card.tsx` returns to its old three lines and the four catalog keys go. The list reader of PR 4 keeps returning the new fields, which nothing renders. No data, no schema, no audit event type                                          |

#### Gates (task 4.12), tip of "-4b-request-card" (the S4 tip), dummy DB

- Full "npm test": 371 files, 9136 tests, all passed, 262.3 s vitest duration. PR 4 was 370 files and 9097 tests; PR 4b adds one test file (request-card) and 39 tests. Against PR 3b (369 files, 9061 tests) all of S4 adds two files and 75 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (143072 lines), the only findings are the same three in files S4 does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the touched files alone is clean, and "npx prettier --check" passes on all of them and on both catalogs.
- "npm test -- src/app/(dashboard)/requests src/i18n": 31 files, 936 tests, all passed.

#### Files (PR 4b; all LF in the working tree, the index was already LF)

| File                                                                                                                                                                                                                  | Action                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/app/(dashboard)/requests/request-card.tsx`                                                                                                                                                                       | Modified: absence label, subjects line, reason line gated on the state; takes the list item |
| `src/app/(dashboard)/requests/request-card.test.tsx`                                                                                                                                                                  | Created: 29 cases                                                                           |
| `src/app/(dashboard)/requests/page.test.tsx`, `src/app/(dashboard)/requests/design-system.test.tsx`, `src/app/(dashboard)/requests/no-signals.test.ts`, `src/i18n/requests-messages.test.ts`                            | Modified: new cases and fuller fixtures                                                     |
| `i18n/es.json`, `i18n/en.json`                                                                                                                                                                                        | Modified: "requests.list.absence", "subjects", "moreSubjects" and "reason"                  |

#### Final Spanish UI copy added in S4 (student screen "requests", "tú"; labels with no verb, so neutral)

- "requests.list.absence": "Fechas de ausencia: {period}" (the period keeps the existing "{start} al {end}" with the month name, for example "1 nov 2026 al 3 nov 2026")
- "requests.list.subjects": "Asignaturas: {codes}"
- "requests.list.moreSubjects": "{codes} y {count} más"
- "requests.list.reason": "Motivo: {reason}" (the same label as "requests.detail.decision.reason"; the reason is the RN-17 label of a returned request, for example "El documento no es legible", or the excerpt of a rejection)

English twins: "Absence dates: {period}"; "Subjects: {codes}"; "{codes} and {count} more"; "Reason: {reason}". The state labels, the title and the other list keys are unchanged.

#### Deviations (all of S4)

1. **`src/app/(dashboard)/requests/page.tsx` not edited.** Task 4.9 lists it, but the page already passes each list item to the card; `src/app/(dashboard)/requests/page.test.tsx` pins the pass-through.
2. **Branch names.** See the PR 4 deviations: "-4-card-reasons" and "-4b-request-card" instead of "-4-request-cards".
3. **Cut at unit 7; both parts over the stop line.** PR 4 606 and PR 4b 520 changed lines. Size exception.
4. **Approved cards (owner decision of 2026-11-20).** The spec, design D7 and tasks 4.1, 4.4 and 4.8 were edited first; the reader never reads an approved decision and the card gates on the state as well.
5. **Reason fallback.** A returned request whose code is not in the catalog shows the excerpt of its text (D7), which the spec's "label of its RN-17 reason code" does not cover; with a known code the label is shown.
6. **Reason line clamp.** The excerpt is at most 140 characters and the card clamps it to 2 lines (owner resolution 3). At 360 px a line holds about 40 characters, so a long excerpt is visually cut by the clamp before the ellipsis the server added; the complete text is on the detail.
7. **Mutation checks with an uncommitted GREEN.** Byte-identical backup copies, checked with "cmp".

### Notes for S5 (RF-08, local preview and file names)

- Base: S5 stacks on "feat/flow-experience-4b-request-card" (the S4 tip, #115).
- Overlap with S4: `src/lib/data/student-requests.ts` (S5 adds `getReturnedDocumentIds` after `getCorrectionReason`, so no conflict with the list reader) and `src/lib/data/student-requests.test.ts` (S4 rewrote only the listOwnRequests block; append a new describe at the end). The helpers `listClass` and `listDecision` in that file serve only the list block.
- `src/app/(dashboard)/requests/design-system.test.tsx` and `src/app/(dashboard)/requests/no-signals.test.ts` skip or scan the "new" and "correct" folders differently: the design pins skip "new" and "correct" (they have their own pins), while the signals scan walks every file under the requests directory, so a new module under "new" must name no signal word.
- Size: S4 ran 4.5 times its forecast and tests were 81 to 88 percent of the lines. S5's forecast is about 240, so expect 700 to 1000; the plan's cut is after unit 10 (the preview component, then the documents step, then the review and resubmit marks). Measure after each unit.
- Pitfalls met in S4: the Write tool turns a typed backslash-u escape into the real character; shell heredocs lose backslashes, and a heredoc with an apostrophe in a quoted body can end the command early, so write scripts and long text with the Write tool and run them with node. A shell count of carriage returns with rg and a dollar-quote was unreliable; count them with a node one-liner. "npx prettier --write <file> --end-of-line lf" converts a CRLF file to LF without changing the index content.
- Still true from S3: resolve the promise of a mocked server action at the end of the test, because React entangles async actions across roots.
- Tooling: only "rg" is installed (no "fd", "bat", "eza", "sd"); the catalog insert helper "i18n-set.cjs" and the "fixengram.sh" script are in the scratchpad.
## Phase 5 (PR 5): S5 RF-08, the local preview and the marked file names

Mode: Strict TDD. Date: 2026-11-20. Branch "feat/flow-experience-5-local-preview", cut from the tip of "feat/flow-experience-4b-request-card" (78b3d80, the S4 tip, #115). Size exception per the owner decision of 2026-11-20 (see Phase 1). Units 9 and 10 (the preview) measured 772 changed lines, over the 460 stop line, so the slice is cut at the plan's cut point, after unit 10:

- **PR 5**, branch "feat/flow-experience-5-local-preview": unit 9 (the preview component) and unit 10 (the documents step offers it). It stacks on #115.
- **PR 5b**, branch "feat/flow-experience-5b-file-marks", cut from the tip of PR 5: unit 11 (the "Nuevo" and "Anterior" marks in the correction flow, FE-16).

### Owner decisions of 2026-11-20 applied here (final)

- The RF-08 preview is client-side only, with browser object URLs (the pattern of `src/app/(dashboard)/catalog/import/credentials-download.tsx`). It writes no audit row and makes no server read.
- It covers the files attached during the current visit to step 3. Older files keep the audited "Ver".
- The resubmit dialog and steps 3 and 4 mark each file "Nuevo" or "Anterior" (PR 5b).

### Commits (PR 5)

| Unit | Hash    | Message                                                            |
| ---- | ------- | ------------------------------------------------------------------ |
| 9    | 033de53 | feat(requests): add the client-side file preview                   |
| 10   | 94310a8 | feat(requests): offer the preview for files attached in this visit |
| docs | (tip)   | docs(flow-experience): record the Phase 5 apply progress for PR 5  |

### TDD cycle evidence (PR 5)

| Task        | Test file                                                       | Layer              | Safety net                            | RED                                                                                                                                                                                                                                                                                        | GREEN             | Triangulation                                                                                                                                                                                                                                                                                                                                                                                                                                    | Refactor                                                        |
| ----------- | --------------------------------------------------------------- | ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 5.1 and 5.2 | `src/app/(dashboard)/requests/new/local-preview.test.tsx` (new) | Unit and component | N/A (new file)                        | The file failed to load (module missing)                                                                                                                                                                                                                                                   | 1 file, 19 passed | previewKind for 8 types (pdf, png, jpeg, gif, svg, html, exe, empty); iframe for a PDF and img for png and jpeg, with the name as title or alt and a blob URL; name and size in es and en; a file the browser cannot render shows name and size only and creates no URL; unmount revokes the exact URL; a StrictMode double mount leaves none unrevoked; a changed file revokes the old URL; no fetch and no route URL; no fixed width at 360 px | The test helper got StrictMode and rerender options (see below) |
| 5.4 and 5.5 | `src/app/(dashboard)/requests/new/documents-step.test.tsx`      | Component          | 28 existing cases of the file passing | 13 cases failed first (closed toggle, open iframe, img, close revokes, two rows, no route, removal revokes and drops, failed removal keeps, unmount revokes, stored document keeps Ver, English, correction flow, 360 px); the "finalize rejects" and "no document id" cases pass at write | 43 passed         | PDF and PNG; closed then open then closed; each row on its own; no fetch and no route URL in the markup; removal revokes and drops, a failed removal keeps; step unmount revokes; a document stored before the visit keeps "Ver" and offers no preview, next to one attached now; a rejected file offers none even if a row with its name appeared; no document id gives none; English; the correction flow; no fixed width                      | None needed                                                     |
| 5.4 and 5.5 | `src/i18n/intake-messages.test.ts`                              | Unit               | Existing cases passing                | 4 cases failed first (exact copy es and en, the informal address, the visible label inside each accessible name in es and en)                                                                                                                                                              | Pass              | Exact copy of the five keys in es and en; no formal "Compruebe"; "{name}" present in both accessible names                                                                                                                                                                                                                                                                                                                                       | None needed                                                     |

### Mutation checks (revert-only; files restored from byte-identical backup copies and checked with "cmp", because the GREEN was not committed yet)

| Pass-at-write test or guard                                                                   | Temporary edit                                                                                             | Result                                                                                                                |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| local-preview "mounts an iframe", the img cases, the StrictMode case, the route case (5.6)    | In `src/app/(dashboard)/requests/new/local-preview.tsx`: the src is a document-route URL                   | 5 local-preview cases failed, and 4 documents-step cases failed, including "reads nothing from the server to preview" |
| local-preview unmount, StrictMode and changed-file cases                                      | In `src/app/(dashboard)/requests/new/local-preview.tsx`: the cleanup does not revoke                       | 3 failed, as expected                                                                                                 |
| documents-step "offers no preview when finalize returns no document id"                       | In `src/app/(dashboard)/requests/new/documents-step.tsx`: a missing id falls back to 9                     | Failed                                                                                                                |
| documents-step "offers no preview, and shows the rejection, for a file that finalize rejects" | In `src/app/(dashboard)/requests/new/documents-step.tsx`: the file is held before the ok check             | Failed (the case was first strengthened to show a row with the rejected name, because the first version passed)       |
| documents-step "keeps Ver, and offers no preview, for a document stored before this visit"    | In `src/app/(dashboard)/requests/new/documents-step.tsx`: a fallback file for every row                    | 4 failed, including it                                                                                                |
| documents-step "keeps the preview when the removal fails"                                     | In `src/app/(dashboard)/requests/new/documents-step.tsx`: the entry is dropped even when the removal fails | Failed                                                                                                                |

### Checkpoint (task 5.12): measured size of PR 5

Measure: "git diff --numstat feat/flow-experience-4b-request-card...HEAD" excluding "openspec/" and ".engram/".

| Scope                                                                     | Changed lines |
| ------------------------------------------------------------------------- | ------------- |
| Unit 9 (component 64, its test 181, shared test helper 55)                | 300           |
| Unit 10 (documents step 157, its test 261, copy test 44, two catalogs 10) | 472           |
| All of PR 5 (725 added, 47 deleted; production 231 and tests 541)         | 772           |

The design forecast for all of S5 was about 240. Units 9 and 10 alone are 3.2 times that. Tests are 70 percent of the lines and were not trimmed. Unit 10 alone is over the 460 stop line, and unit 9 and unit 10 have no seam that would bring either under it, so the slice is cut after unit 10, as the plan says. Size exception.

### Work unit evidence (PR 5)

| Evidence                              | Value                                                                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- src/app/(dashboard)/requests src/i18n": 32 files, 974 tests, all passed                                                                                                                             |
| Runtime harness                       | N/A in this run: the owner-run RF-08 regression on "flow-it" (task 12.2) is not part of Phase 5, and no database or Neon command was run (the dummy DB URL only). The preview never reaches a server, so there is no audit row to compare                    |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/requests/new/local-preview.tsx` is removed, `src/app/(dashboard)/requests/new/documents-step.tsx` returns to its audited "Ver" link for every row, and the five catalog keys go. No data, no schema, no audit event type |

### Gates (task 5.13), tip of "-5-local-preview", dummy DB

- Full "npm test": 372 files, 9174 tests, all passed, 255.2 s vitest duration (4 m 17 s wall). The S4 tip was 371 files and 9136 tests; PR 5 adds one test file (local-preview) and 38 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (142135 findings counted with it), the only findings are the same three in files S5 does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the touched files alone is clean, and "npx prettier --check" passes on every touched file and on both catalogs.

### Files (PR 5; all LF in the working tree, the index was already LF)

| File                                                       | Action                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/(dashboard)/requests/new/local-preview.tsx`       | Created: previewKind and LocalPreview (object URL assigned in an effect, revoked in the cleanup)                                     |
| `src/app/(dashboard)/requests/new/local-preview.test.tsx`  | Created: 19 cases                                                                                                                    |
| `src/app/(dashboard)/requests/new/documents-step.tsx`      | Modified: files held by document id, the "Vista previa" toggle and panel for a file attached in this visit, entry dropped on removal |
| `src/app/(dashboard)/requests/new/documents-step.test.tsx` | Modified: 15 new cases                                                                                                               |
| `src/app/(dashboard)/requests/new/test-support.tsx`        | Modified: stubObjectUrls, and renderIntl keeps the provider on rerender and takes a StrictMode flag                                  |
| `src/i18n/intake-messages.test.ts`                         | Modified: exact copy of the preview keys                                                                                             |
| `i18n/es.json`, `i18n/en.json`                             | Modified: "intake.documents.preview", "previewNamed", "hidePreview", "hidePreviewNamed" and "previewHint"                            |

### Final Spanish UI copy added in PR 5 (student screen "intake", "tú"; the labels have no verb, so neutral)

- "intake.documents.preview": "Vista previa"
- "intake.documents.previewNamed": "Vista previa de {name}" (the accessible name of the toggle)
- "intake.documents.hidePreview": "Ocultar vista previa"
- "intake.documents.hidePreviewNamed": "Ocultar vista previa de {name}"
- "intake.documents.previewHint": "Comprueba que este es el documento correcto antes de continuar."

English twins: "Preview"; "Preview of {name}"; "Hide preview"; "Hide preview of {name}"; "Check that this is the right document before you continue."

### Deviations (PR 5)

1. **Cut after unit 10.** The preview measured 772 lines; PR 5b carries unit 11. Size exception.
2. **Base.** Task 5.0 says "from the PR 4 branch" and tasks 5.12 and 5.14 name "feat/flow-experience-4-request-cards"; the real base is the tip of "feat/flow-experience-4b-request-card" (#115). The PR targets that branch.
3. **Unit 9 lists three files, not two.** The object-URL spies and the StrictMode and rerender options are shared by the preview and documents-step tests, so they live in `src/app/(dashboard)/requests/new/test-support.tsx`. StrictMode only double-runs effects at the root of the tree, so `renderIntl` takes a flag instead of letting each test wrap its own element.
4. **No "previewImageAlt" or "previewPdfTitle" keys.** FE-17 says the preview has the file name as its text alternative, so the image alt and the frame title are the name itself; a "Documento {name}" wrapper would only add a key.
5. **Accessible names.** The design words them "Ver la vista previa de {name}" and "Ocultar la vista previa de {name}"; the visible labels are "Vista previa" and "Ocultar vista previa", and the second accessible name did not contain its visible label (WCAG 2.5.3). The names are now "Vista previa de {name}" and "Ocultar vista previa de {name}". Task 5.4 leaves the exact copy open.
6. **Informal address.** The hint is "Comprueba..." (student screen, owner resolution 1), not the design's "Compruebe...".
7. **Name and size twice.** The preview caption repeats the name and size the row already shows, because FE-17 requires them with the preview and the component also serves a file the browser cannot render.
8. **The preview applies to files attached in this visit only.** A file attached, then a navigation to step 4 and back, has no local copy and shows "Ver" (owner decision 4). The held files live in the step's state and go with it.
9. **Task 5.6.** The documents-step mutation is made in `src/app/(dashboard)/requests/new/local-preview.tsx` because the documents step builds no URL itself.
10. **Mutation checks with an uncommitted GREEN.** As in S1 to S4: byte-identical backup copies, checked with "cmp".
11. **Line endings.** The touched files were CRLF in the working tree (index LF); they were converted to LF without changing the index content. "git status" still lists some as modified (a line-ending artifact only).
12. **Tasks 5.12 to 5.14.** They close when PR 5b is done, over both PRs.
